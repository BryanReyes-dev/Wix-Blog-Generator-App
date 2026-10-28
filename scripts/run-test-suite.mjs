import { spawn } from "node:child_process";

const suites = {
  all: ["auth", "workflow"],
  auth: ["auth"],
  workflow: ["workflow"],
};

const commands = {
  auth: {
    command: "vp",
    args: ["test", "run", "tests/auth-signoff.test.ts"],
  },
  workflow: {
    command: process.execPath,
    args: [
      "--experimental-strip-types",
      "--test",
      "tests/workflow.test.mjs",
    ],
  },
};

const selected = process.argv[2] ?? "all";
const selectedTests = suites[selected];

if (!selectedTests) {
  process.stderr.write(
    `Unknown test suite: ${selected}\nAvailable suites: ${Object.keys(suites).join(", ")}\n`,
  );
  process.exit(2);
}

for (const name of selectedTests) {
  const { command, args } = commands[name];

  process.stdout.write(`\n[Wix Blog Generator] Running ${name} tests\n\n`);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.once("error", (error) => {
      process.stderr.write(`Unable to start ${name} tests: ${error.message}\n`);
      resolve(1);
    });

    child.once("close", (code, signal) => {
      resolve(signal ? 1 : (code ?? 1));
    });
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}