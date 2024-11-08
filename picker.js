const { Client } = require("@notionhq/client");
const fs = require("fs");
const { exec } = require("child_process");
require("dotenv").config();

const key = process.env.NOTION_KEY;
const db = process.env.NOTION_DB;

// Initializing a client
const notion = new Client({
  auth: key,
});

async function loadList() {
  const response = await notion.databases.query({
    database_id: db,
  });

  const data = new Map();

  response.results.forEach(
    ({
      properties: {
        비중: { number },
        이름: {
          title: [{ plain_text: title }],
        },
      },
    }) => {
      data.set(title, number);
    }
  );

  return data;
}

// 로컬의 pickedData.json에서 Map 데이터를 불러와서 반환
async function loadPickedData(path) {
  if (!fs.existsSync(path)) return new Map();
  const data = fs.readFileSync(path);

  if (data.length === 0) return new Map();
  return new Map(Object.entries(JSON.parse(data)));
}

function mapToObject(map) {
  const obj = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

function writePickedData(data) {
  fs.writeFileSync(
    __dirname + "/pickedData.json",
    JSON.stringify(mapToObject(data), null, 2)
  );
}

function pickRandom(data) {
  const tempList = [];
  data.forEach((number, title) => {
    for (let i = 0; i < number; i++) {
      tempList.push(title);
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
  const totalData = await loadList();

  const pickedData = await loadPickedData(__dirname + "/pickedData.json");

  const newData = subtractMaps(totalData, pickedData);

  if (newData.size === 0) {
    console.log("바텀업을 모두 완료했습니다. pickedData를 비워주세요.");
    return;
  }

  const randomOne = pickRandom(newData);

  console.log(randomOne);
  exec(`printf "${randomOne}" | pbcopy`);

  pickedData.set(randomOne, (pickedData.get(randomOne) || 0) + 1);

  writePickedData(pickedData);
}

main();
