const cloudinary = require('cloudinary');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const FormData = require('form-data');
const envalid = require('envalid');
const table = require('text-table');
const { str } = envalid;

exports.handler = async (event, context) => {
    const env = init();
    const battles = await fetch('https://api.royaleapi.com/clan/' + event.clan_id + '/battles?type=war', {
        headers: {
            auth: env.ROYALE_API_KEY,
        },
    });

    const json = await battles.json();
    console.log('json fetched', json);
    const jobs = json
        .filter(battle => {
            return battle.type === 'clanWarWarDay';
        })
        .filter(battle => moment.unix(battle.utcTime).isAfter(moment().subtract(event.minutes || 15, 'minutes')))
        .map(async battle => {
            const warBattleTag = battle.team[0].tag
            let playerBattles = fetch('https://api.royaleapi.com/player/' + warBattleTag + '/battles', {
                headers: {
                    auth: env.ROYALE_API_KEY,
                },
            });
            const warBattleDeck = battle.team[0].deck
            const deckUrl = await buildDeckUrl(warBattleDeck);
            let shortDeckUrl = shortenUrl(deckUrl);
            let shortDeckLink = shortenUrl(`${battle.team[0].deckLink}&war=1`);
            let shortProfileLink = shortenUrl(`https://royaleapi.com/player/${warBattleTag}`);
            [playerBattles, shortDeckUrl, shortDeckLink, shortProfileLink] = await Promise.all([
                playerBattles,
                shortDeckUrl,
                shortDeckLink,
                shortProfileLink,
            ]);

            const playerBattlesJson = await playerBattles.json();
            if (!playerBattlesJson || !Array.isArray(playerBattlesJson)) {
                console.log('Not array', playerBattlesJson);
                return '';
            }

            const countTable = createCountTable(
              deckMatchCounts(
                warBattleDeck,
                warBattleTag,
                playerBattlesJson
              )
            );

            const trainingMatches = playerBattlesJson.filter(
                playerBattle =>
                    (equalDeck(warBattleDeck, playerBattle.team[0].deck) &&
                        warBattleTag === playerBattle.team[0].tag) ||
                    (equalDeck(warBattleDeck, playerBattle.opponent[0].deck) &&
                        warBattleTag === playerBattle.opponent[0].tag)
            );
            const groupedMatches = groupBy(trainingMatches, 'type');

            const totalTrainingCount =
                (groupedMatches['clanMate'] ? groupedMatches['clanMate'].length : 0) +
                (groupedMatches['challenge'] ? groupedMatches['challenge'].length : 0) +
                (groupedMatches['PvP'] ? groupedMatches['PvP'].length : 0) +
                (groupedMatches['tournament'] ? groupedMatches['tournament'].length : 0);

            const allFriendlies = playerBattlesJson.filter(battle => battle.type === 'clanMate').length;
            const text =
                `${battle.winner >= 1 ? 'Victory! :raised_hands:' : 'Loss :crying_cat_face:'}\n` +
                `${battle.team[0].name} (${battle.team[0].startTrophies}) vs ${battle.opponent[0].name} (${battle.opponent[0].startTrophies}) at ` +
                `${moment
                    .unix(battle.utcTime)
                    .locale(env.MOMENT_LOCALE)
                    .tz(env.TIME_ZONE)
                    .format(env.MOMENT_DATETIME_FORMAT)}.\n` +
                `${battle.team[0].name} (<${shortProfileLink}>) trained a total of ${totalTrainingCount} times with the war deck ` +
                `(${shortDeckUrl} ${shortDeckLink}). ` +
                `A total of ${allFriendlies} friendlies during the last 25 battles.\n` +
                `${countTable}`;
            console.log('Returning text: ' + text);
            return text;
        })
        .map(async text => {
            text = await text;
            const responseText = JSON.stringify({ content: text });
            return await fetch('https://discordapp.com/api/webhooks/' + event.discord_key + '?wait=true', {
                method: 'POST',
                body: responseText,
                headers: { 'Content-Type': 'application/json' },
            });
        });
    const results = await Promise.all(jobs);
    results.forEach(promise => console.log(promise.status, promise.statusText));
    return results;
};

const init = () => {
    const env = envalid.cleanEnv(process.env, {
        CLOUDINARY_NAME: str(),
        CLOUDINARY_KEY: str(),
        CLOUDINARY_SECRET_KEY: str(),
        ROYALE_API_KEY: str(),
        MOMENT_LOCALE: str({ default: 'nb' }),
        TIME_ZONE: str({ default: 'Europe/Oslo' }),
        MOMENT_DATETIME_FORMAT: str({ default: 'lll' }),
    });

    require('moment/locale/' + env.MOMENT_LOCALE);
    cloudinary.config({
        cloud_name: env.CLOUDINARY_NAME,
        api_key: env.CLOUDINARY_KEY,
        api_secret: env.CLOUDINARY_SECRET_KEY,
    });

    return env;
};

const numEqual = (warDeck, otherDeck) => {
    const warSet = new Set(warDeck.map(card => card.key));
    const otherSet = new Set(otherDeck.map(card => card.key));
    const intersection = new Set([...warSet].filter(key => otherSet.has(key)));
    return intersection.size;
};

const deckMatchCounts = (warDeck, warBattleTag, playerBattles) =>
  playerBattles.map(playerBattle => {
    const playerBattleDeck =
      playerBattle.team
        .concat(playerBattle.opponent)
        .find(p => p.tag === warBattleTag)
        .deck;
    return {
      type: playerBattle.type,
      equalCards: numEqual(warDeck, playerBattleDeck)
    };
  });

const countArr = countGroup => countGroup.reduce(
  (arr, {equalCards}) => {
    const countIdx = 8 - equalCards;
    if(countIdx < 5) {
      arr[countIdx] = arr[countIdx] + 1;
    }
    return arr;
  },
  [0, 0, 0, 0, 0]
);

const createCountTable = matchCounts => {
  const grouped = groupBy(matchCounts, 'type');

  const tableRows = [
    ["", "WD", "-1", "-2", "-3", "-4"],
    []
  ];

  const totalCounts = ["Total", 0, 0, 0, 0, 0];

  Object.entries(grouped).forEach(
    ([type, counts]) => {
      const typeCounts = countArr(counts);
      tableRows.push([type, ...typeCounts]);
      for (let i = 0; i < 5; i++) {
        totalCounts[i + 1] += typeCounts[i];
      }
    }
  );

  tableRows.push([]);
  tableRows.push(totalCounts);

  return "```\n" + table(
    tableRows,
    {align: ['l', 'r', 'r', 'r', 'r', 'r']}
  ) + "\n```";
}

const equalDeck = (warDeck, otherDecks) => {
    const otherDeckString = otherDecks
        .map(card => card.key)
        .sort()
        .join();
    const warDeckString = warDeck
        .map(card => card.key)
        .sort()
        .join();
    return otherDeckString === warDeckString;
};

const groupBy = (xs, key) => {
    return xs.reduce(function(rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};

const shortenUrl = async deckUrl => {
    const urlEncoded = encodeURIComponent(deckUrl);
    console.log(`https://is.gd/create.php?format=simple&url=${urlEncoded}`);
    const response = await fetch(`https://is.gd/create.php?format=simple&url=${urlEncoded}`, {
        method: 'GET',
    });
    return await response.text();
};

const buildDeckUrl = async deck => {
    const card1 = { key: deck[0].key, level: deck[0].displayLevel };
    const card2 = { key: deck[1].key, level: deck[1].displayLevel };
    const card3 = { key: deck[2].key, level: deck[2].displayLevel };
    const card4 = { key: deck[3].key, level: deck[3].displayLevel };
    const card5 = { key: deck[4].key, level: deck[4].displayLevel };
    const card6 = { key: deck[5].key, level: deck[5].displayLevel };
    const card7 = { key: deck[6].key, level: deck[6].displayLevel };
    const card8 = { key: deck[7].key, level: deck[7].displayLevel };

    return cloudinary.url(`CR/${card1.key}`, {
        secure: true,
        transformation: [
            { width: 100, height: 100, crop: 'scale', x: 0, y: 0 },
            { overlay: `text:Arial_20_bold:Level%20${card1.level},co_white`, gravity: 'south' },
            { height: 100, overlay: `CR:${card2.key}`, width: 100, x: 100, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card2.level},co_white`, gravity: 'south', x: 50 },
            { height: 100, overlay: `CR:${card3.key}`, width: 100, x: 150, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card3.level},co_white`, gravity: 'south', x: 100 },
            { height: 100, overlay: `CR:${card4.key}`, width: 100, x: 200, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card4.level},co_white`, gravity: 'south', x: 150 },
            { height: 100, overlay: `CR:${card5.key}`, width: 100, x: -150, y: 100, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card5.level},co_white`, gravity: 'south', x: -150 },
            { height: 100, overlay: `CR:${card6.key}`, width: 100, x: -50, y: 50, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card6.level},co_white`, gravity: 'south', x: -50 },
            { height: 100, overlay: `CR:${card7.key}`, width: 100, x: 50, y: 50, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card7.level},co_white`, gravity: 'south', x: 50 },
            { height: 100, overlay: `CR:${card8.key}`, width: 100, x: 150, y: 50, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card8.level},co_white`, gravity: 'south', x: 150 },
        ],
    });
};

//exports.deckMatchCounts = deckMatchCounts
//exports.createCountTable = createCountTable
