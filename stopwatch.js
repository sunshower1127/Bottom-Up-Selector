const readline = require("readline");
const { exec } = require("child_process");

let secondsElapsed = 0;
let timerInterval;

const minMinutes = 20;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

function startStopwatch() {
  timerInterval = setInterval(() => {
    secondsElapsed++;
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`시간: ${formatTime(secondsElapsed)}`);

    if (secondsElapsed === minMinutes * 60)
      exec(
        'terminal-notifier -message "20분 지남!" -title "바텀업 알림" -sound default'
      );
  }, 1000);
}

function stopStopwatch() {
  clearInterval(timerInterval);
  const finalTime = formatTime(secondsElapsed);
  console.log(`\nFinal time: ${finalTime}`);
  exec(`printf "${finalTime.split(":")[0]}" | pbcopy`);
  rl.close();
}

console.log("바텀업 시작");

startStopwatch();

rl.input.on("keypress", (char, key) => {
  if (key && key.name === "return") {
    stopStopwatch();
  }
});
