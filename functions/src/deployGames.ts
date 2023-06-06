import { Games } from "./games/GameData";
import fs = require('fs');

const games:any = {}

Games.forEach(gameList => {
    Object.keys(gameList).forEach(key => {
        games[key] = gameList[key];
    })
});

console.log("Writing games to file");
fs.writeFile('./emulator_data/database_export/threepixelheart-f5674-default-rtdb.json', JSON.stringify({games}, null, 2), 'utf8', () => {});
fs.writeFile('./emulator_data/database_export/games.json', JSON.stringify(games, null, 2), 'utf8', () => {});
