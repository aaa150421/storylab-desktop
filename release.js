const fs = require("fs");
const { execFileSync } = require("child_process");
const readline = require("readline");

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function runGit(args) {
  execFileSync("git", args, { stdio: "inherit" });
}

function stop(message) {
  console.error("\n배포 중단: " + message);
  process.exitCode = 1;
}

async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(question, answer => {
    rl.close();
    resolve(answer.trim().toLowerCase());
  }));
}

async function main() {
  if (git(["branch", "--show-current"]) !== "main") {
    return stop("main 브랜치에서 실행해 주세요.");
  }

  if (git(["status", "--porcelain"])) {
    return stop("작업 폴더에 변경 사항이 있습니다. 파일을 삭제하지 말고 먼저 상태를 확인해 주세요.");
  }

  runGit(["fetch", "origin", "main", "--tags"]);

  if (git(["rev-parse", "HEAD"]) !== git(["rev-parse", "origin/main"])) {
    return stop("로컬 main과 origin/main이 다릅니다. 먼저 동기화해 주세요.");
  }

  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));

  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    return stop("package.json 버전이 x.y.z 형식이 아닙니다.");
  }

  if (lock.version !== pkg.version || lock.packages?.[""]?.version !== pkg.version) {
    return stop("package.json과 package-lock.json 버전이 일치하지 않습니다.");
  }

  const [major, minor, patch] = pkg.version.split(".").map(Number);
  const next = `${major}.${minor}.${patch + 1}`;
  const tag = `v${next}`;

  if (git(["tag", "--list", tag])) {
    return stop(`태그 ${tag}가 이미 존재합니다.`);
  }

  console.log(`\n현재 버전: ${pkg.version}`);
  console.log(`새 버전: ${next}`);

  if (await ask(`버전을 ${next}로 올리고 GitHub에 배포할까요? (y/N): `) !== "y") {
    return stop("사용자가 취소했습니다.");
  }

  pkg.version = next;
  lock.version = next;
  lock.packages[""].version = next;

  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n", "utf8");
  fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n", "utf8");

  runGit(["add", "package.json", "package-lock.json"]);
  runGit(["commit", "-m", `Prepare release ${next}`]);

  console.log(`\n${tag} 릴리스 커밋을 준비했습니다.`);
  console.log("main 브랜치에 버전을 푸시하면 GitHub Actions가 태그와 설치 파일을 게시합니다.");

  runGit(["push", "origin", "main"]);

  console.log(`\n${next} 버전 코드를 올렸습니다. GitHub Actions에서 빌드 및 배포 상태를 확인해 주세요.`);
}

main().catch(error => {
  console.error("\n오류가 발생했습니다:", error.message);
  process.exitCode = 1;
});
