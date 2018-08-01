const cloudinary = require('cloudinary');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const FormData = require('form-data');
require('moment/locale/nb');

cloudinary.config({
    cloud_name: 'fullfartfoto',
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

exports.handler = async (event, context) => {
    const battles = await fetch('https://api.royaleapi.com/clan/' + event.clan_id + '/battles?type=war', {
        headers: {
            auth: process.env.ROYALE_API_KEY,
        },
    });

    const json = await battles.json();
    const jobs = json
        .filter(battle => {
            return battle.type === 'clanWarWarDay';
        })
        .filter(battle =>
            moment
                .unix(battle.utcTime)
                .utc()
                .isAfter(
                    moment()
                        .utc()
                        .subtract(event.minutes || 15, 'minutes')
                )
        )
        .map(async battle => {
            let playerBattles = fetch('https://api.royaleapi.com/player/' + battle.team[0].tag + '/battles', {
                headers: {
                    auth: process.env.ROYALE_API_KEY,
                },
            });
            const deckUrl = await buildDeckUrl(battle.team[0].deck);
            let shortDeckUrl = shortenUrl(deckUrl);
            let shortDeckLink = shortenUrl(`${battle.team[0].deckLink}&war=1`);
            let shortProfileLink = shortenUrl(`https://royaleapi.com/player/${battle.team[0].tag}`);
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

            const trainingMatches = playerBattlesJson.filter(
                playerBattle =>
                    (equalDeck(battle.team[0].deck, playerBattle.team[0].deck) &&
                        battle.team[0].tag === playerBattle.team[0].tag) ||
                    (equalDeck(battle.team[0].deck, playerBattle.opponent[0].deck) &&
                        battle.team[0].tag === playerBattle.opponent[0].tag)
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
                `${battle.team[0].name} vs ${battle.opponent[0].name} at ` +
                `${moment
                    .unix(battle.utcTime)
                    .locale('nb')
                    .tz('Europe/Oslo')
                    .format('lll')}.\n` +
                `${battle.team[0].name} trained a total of ${totalTrainingCount} times with the war deck ` +
                `(${groupedMatches['clanMate'] ? groupedMatches['clanMate'].length : 0} friendlies, ` +
                `${groupedMatches['challenge'] ? groupedMatches['challenge'].length : 0} in challenges and ` +
                `${groupedMatches['PvP'] ? groupedMatches['PvP'].length : 0} on ladder and ` +
                `${groupedMatches['tournament'] ? groupedMatches['tournament'].length : 0} in tournaments). ` +
                `A total of ${allFriendlies} friendlies during the last 25 battles.\n` +
                `Deck: ${shortDeckUrl}. Copy deck: ${shortDeckLink}. RoyaleApi profile: <${shortProfileLink}>.`;
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

const equalDeck = (warDeck, otherDecks) => {
    console.log('comparing');
    const otherDeckString = otherDecks
        .map(card => card.key)
        .sort()
        .join();
    const warDeckString = warDeck
        .map(card => card.key)
        .sort()
        .join();
    console.log('comparing ', warDeckString, 'and', otherDeckString);
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
    const card1 = { key: deck[0].key, level: deck[0].level };
    const card2 = { key: deck[1].key, level: deck[1].level };
    const card3 = { key: deck[2].key, level: deck[2].level };
    const card4 = { key: deck[3].key, level: deck[3].level };
    const card5 = { key: deck[4].key, level: deck[4].level };
    const card6 = { key: deck[5].key, level: deck[5].level };
    const card7 = { key: deck[6].key, level: deck[6].level };
    const card8 = { key: deck[7].key, level: deck[7].level };

    return cloudinary.url(`CR/${card1.key}`, {
        secure: true,
        transformation: [
            { width: 100, height: 120, crop: 'scale', x: 0, y: 0 },
            { overlay: `text:Arial_20_bold:Level%20${card1.level},co_white`, gravity: 'south' },
            { height: 120, overlay: `CR:${card2.key}`, width: 100, x: 100, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card2.level},co_white`, gravity: 'south', x: 50 },
            { height: 120, overlay: `CR:${card3.key}`, width: 100, x: 150, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card3.level},co_white`, gravity: 'south', x: 100 },
            { height: 120, overlay: `CR:${card4.key}`, width: 100, x: 200, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card4.level},co_white`, gravity: 'south', x: 150 },
            { height: 120, overlay: `CR:${card5.key}`, width: 100, x: -150, y: 120, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card5.level},co_white`, gravity: 'south', x: -150 },
            { height: 120, overlay: `CR:${card6.key}`, width: 100, x: -50, y: 60, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card6.level},co_white`, gravity: 'south', x: -50 },
            { height: 120, overlay: `CR:${card7.key}`, width: 100, x: 50, y: 60, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card7.level},co_white`, gravity: 'south', x: 50 },
            { height: 120, overlay: `CR:${card8.key}`, width: 100, x: 150, y: 60, crop: 'scale' },
            { overlay: `text:Arial_20_bold:Level%20${card8.level},co_white`, gravity: 'south', x: 150 },
        ],
    });
};
