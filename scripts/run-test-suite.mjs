import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TEST_SUITES = Object.freeze({
  all: Object.freeze(["runner", "auth", "workflow"]),
  runner: Object.freeze(["runner"]),
  auth: Object.freeze(["auth"]),
  workflow: Object.freeze(["workflow"]),
});

function commandFor(name, nodePath) {
  switch (name) {
    case "runner":
      return {
        command: nodePath,
        args: ["--test", "tests/test-suite-runner.test.mjs"],
      };
    case "auth":
      return {
        command: "vp",
        args: ["test", "run", "tests/auth-signoff.test.ts"],
      };
    case "workflow":
      return {
        command: nodePath,
        args: [
          "--experimental-strip-types",
          "--test",
          "tests/workflow.test.mjs",
        ],
      };
    default:
      throw new Error(`Unrecognized test name: ${name}`);
  }
}

/**
 * Run one named test suite. Dependencies are injectable so suite dispatch and
 * failure handling can be tested without launching the real test processes.
 */
export async function runTestSuite(
  selected = "all",
  {
    spawnCommand = spawn,
    env = process.env,
    nodePath = process.execPath,
    platform = process.platform,
    writeOut = (message) => process.stdout.write(message),
    writeErr = (message) => process.stderr.write(message),
  } = {},
) {
  const selectedTests = Object.hasOwn(TEST_SUITES, selected)
    ? TEST_SUITES[selected]
    : undefined;

  if (!selectedTests) {
    writeErr(
      `Unknown test suite: ${selected}\nAvailable suites: ${Object.keys(TEST_SUITES).join(", ")}\n`,
    );
    return 2;
  }

  for (const name of selectedTests) {
    const { command, args } = commandFor(name, nodePath);

    writeOut(`\n[Wix Blog Generator] Running ${name} tests\n\n`);

    const exitCode = await new Promise((resolveExit) => {
      let settled = false;
      const finish = (code) => {
        if (settled) return;
        settled = true;
        resolveExit(code);
      };

      let child;
      try {
        child = spawnCommand(command, args, {
          env,
          stdio: "inherit",
          shell: platform === "win32",
        });
      } catch (error) {
        writeErr(
          `Unable to start ${name} tests: ${error instanceof Error ? error.message : String(error)}\n`,
        );
        finish(1);
        return;
      }

      child.once("error", (error) => {
        writeErr(`Unable to start ${name} tests: ${error.message}\n`);
        finish(1);
      });

      child.once("close", (code, signal) => {
        finish(signal ? 1 : (code ?? 1));
      });
    });

    if (exitCode !== 0) {
      return exitCode;
    }
  }

  return 0;
}

const invokedScriptUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === invokedScriptUrl) {
  runTestSuite(process.argv[2] ?? "all")
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(
        `Test suite runner failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
