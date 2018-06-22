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
                        .subtract(15, 'minutes')
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

            [playerBattles, shortDeckUrl, shortDeckLink] = await Promise.all([
                playerBattles,
                shortDeckUrl,
                shortDeckLink,
            ]);

            const playerBattlesJson = await playerBattles.json();

            const trainingMatches = playerBattlesJson
                .filter(
                    playerBattle =>
                        playerBattle.type === 'clanMate' ||
                        playerBattle.type === 'challenge' ||
                        playerBattle.type === 'tournament'
                )
                .filter(
                    playerBattle =>
                        (playerBattle.team[0].deckLink === battle.team[0].deckLink &&
                            playerBattle.team[0].tag === battle.team[0].tag) ||
                        (playerBattle.opponent[0].deckLink === battle.team[0].deckLink &&
                            playerBattle.opponent[0].tag === battle.team[0].tag)
                ).length;

            const text =
                `${battle.winner >= 1 ? 'Victory! :raised_hands:' : 'Loss :crying_cat_face:'}\n` +
                `${battle.team[0].name} vs ${battle.opponent[0].name} at ` +
                `${moment
                    .unix(battle.utcTime)
                    .locale('nb')
                    .tz('Europe/Oslo')
                    .format('lll')}.\n` +
                `${
                    battle.team[0].name
                } trained ${trainingMatches} times with this deck (challenges, friendlies, tournaments) (last 25 battles).\n` +
                `Deck: ${shortDeckUrl} Copy deck here: ${shortDeckLink}`;
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

const shortenUrl = async deckUrl => {
    const form = new FormData();
    console.log(deckUrl);
    form.append('url', deckUrl);
    form.append('action', 'shorturl');
    form.append('format', 'json');
    const response = await fetch('http://tny.im/yourls-api.php', {
        method: 'POST',
        body: form,
    });
    const shortUrlResponse = await response.json();
    return shortUrlResponse.shorturl;
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
