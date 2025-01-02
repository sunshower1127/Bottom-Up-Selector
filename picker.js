const { Client } = require("@notionhq/client");
const fs = require("fs");
const { exec } = require("child_process");
require("dotenv").config();

const key = process.env.NOTION_KEY;

const DbIds = {
  study: process.env.STUDY_DB,
  game: process.env.GAME_DB,
  media: process.env.MEDIA_DB,
};
const doneListPaths = {
  study: __dirname + "/pickedDataStudy.json",
  game: __dirname + "/pickedDataGame.json",
  media: __dirname + "/pickedDataMedia.json",
};

const mainInterface = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Initializing a client
const notion = new Client({
  auth: key,
});

function sortMap(map) {
  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function mergeMaps(...maps) {
  const mergedMap = new Map();

  maps.forEach((map) => {
    map.forEach((value, key) => {
      mergedMap.set(key, (mergedMap.get(key) || 0) + value);
    });
  });

  return mergedMap;
}

async function fetchTodoList(dbName) {
  const dbId = DbIds[dbName];
  const data = new Map();

  const response = await notion.databases.query({
    database_id: dbId,
  });
  response.results.forEach(
    ({
      properties: {
        비중: { number },
        진행상황: {
          title: [{ plain_text: title }],
        },
      },
    }) => {
      if (number === 0) return;
      const newTitle = title.split(" |")[0];
      if (data.has(newTitle)) {
        data.set(newTitle, data.get(newTitle) + number);
      } else {
        data.set(newTitle, number);
      }
    }
  );

  return data;
}

// 로컬의 pickedData.json에서 Map 데이터를 불러와서 반환
async function readDoneFile(path) {
  try {
    const data = await fs.promises.readFile(path);
    const mapData = new Map(Object.entries(JSON.parse(data)));
    const combinedData = new Map();
    mapData.forEach((value, key) => {
      combinedData.set(key, (combinedData.get(key) || 0) + value);
    });
    return combinedData;
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.promises.writeFile(path, JSON.stringify({}));
      return new Map();
    }
    throw error;
  }
}

function mapToObject(map) {
  const obj = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

function writeDoneData(path, data) {
  fs.writeFileSync(path, JSON.stringify(mapToObject(data), null, 2));
}

function pickRandom(data) {
  const tempList = [];
  data.forEach((number, title) => {
    for (let i = 0; i < number; i++) {
      tempList.push({ title, number });
    }
  });

  const randomIndex = Math.floor(Math.random() * tempList.length);
  return tempList[randomIndex];
}

function subtractMaps(totalData, pickedData) {
  const result = new Map();

  totalData.forEach((value, key) => {
    if (pickedData.has(key)) {
      const difference = value - pickedData.get(key);
      if (difference > 0) {
        result.set(key, difference);
      }
    } else {
      result.set(key, value);
    }
  });

  return result;
}

async function main() {
  mainInterface.question(
    "(s)tudy/(m)edia/(g)ame 선택(중복가능): ",
    async (choice) => {
      let selectedDbs = [];

      if (choice.includes("s")) selectedDbs.push("study");
      if (choice.includes("m")) selectedDbs.push("media");
      if (choice.includes("g")) selectedDbs.push("game");
      if (selectedDbs.length === 0) {
        console.log("잘못된 선택입니다.");
        mainInterface.close();
        return;
      }

      let subTodoData = {};

      await Promise.all(
        selectedDbs.map(async (db) => {
          subTodoData[db] = await fetchTodoList(db);
        })
      );

      const todoData = mergeMaps(...Object.values(subTodoData));

      let subDoneData = {};

      await Promise.all(
        selectedDbs.map(async (db) => {
          subDoneData[db] = await readDoneFile(doneListPaths[db]);
        })
      );

      const doneData = mergeMaps(...Object.values(subDoneData));

      let remainingData = subtractMaps(todoData, doneData);

      if (remainingData.size === 0) {
        console.log("바텀업을 모두 완료했습니다. pickedData를 비워주세요.");
        return;
      }

      const { title: randomOne, number } = pickRandom(remainingData);

      exec(`printf "${randomOne}" | pbcopy`);
      console.log(`${randomOne} (최대 ${number}개 가능)`);

      // pickedData.set(randomOne, (pickedData.get(randomOne) || 0) + 1);
      // writePickedData(pickedData);

      mainInterface.close();
      const stopwatch = require("./stopwatch");

      stopwatch.rl.input.once("keypress", (char, key) => {
        stopwatch.stopStopwatch();
        stopwatch.rl.question("몇시간 짜리인지: ", (input) => {
          const number = parseInt(input, 10);
          if (number) {
            const db = Object.entries(subTodoData).find(([key, value]) =>
              value.has(randomOne)
            )[0];

            subDoneData[db].set(
              randomOne,
              (subDoneData[db].get(randomOne) || 0) + number
            );

            writeDoneData(doneListPaths[db], sortMap(subDoneData[db]));

            console.log(`${randomOne}: ${subDoneData[db].get(randomOne)}`);
          }
          stopwatch.rl.close();
        });
      });
    }
  );
}

main();
