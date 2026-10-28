import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  TEST_SUITES,
  runTestSuite,
} from "../scripts/run-test-suite.mjs";

function makeSpawn(outcomes = []) {
  const calls = [];
  const spawnCommand = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    const outcome = outcomes.shift() ?? { code: 0 };

    queueMicrotask(() => {
      if (outcome.error) {
        child.emit("error", outcome.error);
        return;
      }

      child.emit("close", outcome.code ?? 0, outcome.signal ?? null);
    });

    return child;
  };

  return { calls, spawnCommand };
}

function makeOutput() {
  const stdout = [];
  const stderr = [];

  return {
    stdout,
    stderr,
    writeOut: (message) => stdout.push(message),
    writeErr: (message) => stderr.push(message),
  };
}

test("named suites contain the expected tests without duplicates", () => {
  assert.deepEqual(TEST_SUITES.all, ["runner", "auth", "workflow"]);
  assert.deepEqual(TEST_SUITES.runner, ["runner"]);
  assert.deepEqual(TEST_SUITES.auth, ["auth"]);
  assert.deepEqual(TEST_SUITES.workflow, ["workflow"]);
  assert.equal(new Set(TEST_SUITES.all).size, TEST_SUITES.all.length);
});

test("unknown suite names fail with exit code 2 without spawning a process", async () => {
  const output = makeOutput();
  const result = await runTestSuite("not-a-suite", {
    spawnCommand: () => assert.fail("unknown suites must not spawn a process"),
    ...output,
  });

  assert.equal(result, 2);
  assert.match(output.stderr.join(""), /Unknown test suite: not-a-suite/);
  assert.match(output.stderr.join(""), /Available suites: all, runner, auth, workflow/);
});

test("the all suite runs runner, auth, and workflow tests in order", async () => {
  const output = makeOutput();
  const { calls, spawnCommand } = makeSpawn([
    { code: 0 },
    { code: 0 },
    { code: 0 },
  ]);

  const result = await runTestSuite("all", {
    spawnCommand,
    nodePath: "/test-runtime/node",
    platform: "win32",
    ...output,
  });

  assert.equal(result, 0);
  assert.deepEqual(
    calls.map(({ command, args }) => ({ command, args })),
    [
      {
        command: "/test-runtime/node",
        args: ["--test", "tests/test-suite-runner.test.mjs"],
      },
      {
        command: "vp",
        args: ["test", "run", "tests/auth-signoff.test.ts"],
      },
      {
        command: "/test-runtime/node",
        args: [
          "--experimental-strip-types",
          "--test",
          "tests/workflow.test.mjs",
        ],
      },
    ],
  );
  assert.ok(calls.every((call) => call.options.shell === true));
  assert.ok(calls.every((call) => call.options.stdio === "inherit"));
});

test("a failing suite returns its exit code and prevents later suites from running", async () => {
  const output = makeOutput();
  const { calls, spawnCommand } = makeSpawn([
    { code: 0 },
    { code: 17 },
    { code: 0 },
  ]);

  const result = await runTestSuite("all", {
    spawnCommand,
    nodePath: "/test-runtime/node",
    platform: "linux",
    ...output,
  });

  assert.equal(result, 17);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.shell === false));
});

test("a child-process start error fails closed and stops the suite", async () => {
  const output = makeOutput();
  const { calls, spawnCommand } = makeSpawn([
    { error: new Error("simulated process start failure") },
    { code: 0 },
  ]);

  const result = await runTestSuite("all", {
    spawnCommand,
    nodePath: "/test-runtime/node",
    ...output,
  });

  assert.equal(result, 1);
  assert.equal(calls.length, 1);
  assert.match(
    output.stderr.join(""),
    /Unable to start runner tests: simulated process start failure/,
  );
});

test("a terminated child process is treated as a failure", async () => {
  const output = makeOutput();
  const { calls, spawnCommand } = makeSpawn([
    { code: null, signal: "SIGTERM" },
  ]);

  const result = await runTestSuite("auth", {
    spawnCommand,
    ...output,
  });

  assert.equal(result, 1);
  assert.equal(calls.length, 1);
});

test("the CLI entrypoint reports invalid suite names with exit code 2", () => {
  const runnerPath = fileURLToPath(
    new URL("../scripts/run-test-suite.mjs", import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [runnerPath, "not-a-suite"],
    { encoding: "utf8" },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown test suite: not-a-suite/);
  assert.match(result.stderr, /Available suites: all, runner, auth, workflow/);
});

test("prototype property names are rejected as unknown suites", async () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    const output = makeOutput();
    const result = await runTestSuite(name, {
      spawnCommand: () => assert.fail("unknown suites must not spawn a process"),
      ...output,
    });

    assert.equal(result, 2);
    assert.match(output.stderr.join(""), new RegExp(`Unknown test suite: ${name}`));
  }
});
