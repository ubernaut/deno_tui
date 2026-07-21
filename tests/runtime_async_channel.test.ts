import { assertEquals, assertInstanceOf, assertRejects, assertStrictEquals, assertThrows } from "./deps.ts";
import {
  AsyncChannel,
  AsyncChannelAbortedError,
  AsyncChannelClosedError,
  AsyncChannelDisposedError,
  AsyncChannelOperationAbortedError,
  AsyncChannelOverflowError,
  AsyncChannelSequenceOverflowError,
  AsyncChannelWaiterLimitError,
} from "../src/runtime/async_channel.ts";

Deno.test("async channels validate capacity, policy, and rendezvous construction", async () => {
  for (const capacity of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrows(() => new AsyncChannel({ capacity }), RangeError);
  }
  assertThrows(
    () => new AsyncChannel({ capacity: 1, overflowPolicy: "unknown" as "block" }),
    TypeError,
  );
  assertThrows(() => new AsyncChannel({ capacity: 1, initialSequence: 0 }), RangeError);
  for (const limit of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrows(() => new AsyncChannel({ capacity: 1, maxPendingSends: limit }), RangeError);
    assertThrows(() => new AsyncChannel({ capacity: 1, maxPendingReceives: limit }), RangeError);
  }
  assertThrows(
    () => new AsyncChannel({ capacity: 0, overflowPolicy: "drop-newest" }),
    RangeError,
  );

  const channel = new AsyncChannel<string>({ capacity: 0 });
  const first = channel.send("first");
  const second = channel.send("second");
  assertEquals(channel.inspect().depth, 0);
  assertEquals(channel.inspect().pendingSends, 2);

  assertEquals(await channel.receive(), { done: false, value: "first", sequence: 1 });
  assertEquals(await first, { sequence: 1, status: "delivered", accepted: true, dropped: 0 });
  assertEquals(await channel.receive(), { done: false, value: "second", sequence: 2 });
  assertEquals(await second, { sequence: 2, status: "delivered", accepted: true, dropped: 0 });
  assertEquals(channel.inspect().pendingSends, 0);
});

Deno.test("blocking channels preserve FIFO producer fairness while refilling capacity", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1, overflowPolicy: "block" });
  assertEquals(await channel.send("buffered"), {
    sequence: 1,
    status: "buffered",
    accepted: true,
    dropped: 0,
  });
  const second = channel.send("second");
  const third = channel.send("third");
  assertEquals(channel.inspect().pendingSends, 2);

  assertEquals(await channel.receive(), { done: false, value: "buffered", sequence: 1 });
  assertEquals(await second, { sequence: 2, status: "buffered", accepted: true, dropped: 0 });
  assertEquals(channel.inspect().pendingSends, 1);
  assertEquals(await channel.receive(), { done: false, value: "second", sequence: 2 });
  assertEquals(await third, { sequence: 3, status: "buffered", accepted: true, dropped: 0 });
  assertEquals(await channel.receive(), { done: false, value: "third", sequence: 3 });
  assertEquals(channel.inspect().sent, 3);
  assertEquals(channel.inspect().received, 3);
});

Deno.test("channels preserve FIFO consumer fairness with direct delivery", async () => {
  const channel = new AsyncChannel<string>({ capacity: 2 });
  const first = channel.receive();
  const second = channel.receive();
  const third = channel.receive();
  assertEquals(channel.inspect().pendingReceives, 3);

  assertEquals(await channel.send("a"), { sequence: 1, status: "delivered", accepted: true, dropped: 0 });
  assertEquals(await channel.send("b"), { sequence: 2, status: "delivered", accepted: true, dropped: 0 });
  assertEquals(await channel.send("c"), { sequence: 3, status: "delivered", accepted: true, dropped: 0 });
  assertEquals(await Promise.all([first, second, third]), [
    { done: false, value: "a", sequence: 1 },
    { done: false, value: "b", sequence: 2 },
    { done: false, value: "c", sequence: 3 },
  ]);
  assertEquals(channel.inspect().pendingReceives, 0);
});

Deno.test("drop-newest rejects only the incoming full-buffer value", async () => {
  const channel = new AsyncChannel<string>({ capacity: 2, overflowPolicy: "drop-newest" });
  await channel.send("a");
  await channel.send("b");
  assertEquals(await channel.send("c"), {
    sequence: 3,
    status: "dropped-newest",
    accepted: false,
    dropped: 1,
  });

  channel.close();
  assertEquals(await channel.receive(), { done: false, value: "a", sequence: 1 });
  assertEquals(await channel.receive(), { done: false, value: "b", sequence: 2 });
  assertEquals(await channel.receive(), { done: true, value: undefined });
  assertEquals(channel.inspect().droppedByPolicy, {
    dropNewest: 1,
    dropOldest: 0,
    conflate: 0,
    abort: 0,
    dispose: 0,
  });
});

Deno.test("drop-oldest evicts the FIFO head and accepts the incoming value", async () => {
  const channel = new AsyncChannel<string>({ capacity: 2, overflowPolicy: "drop-oldest" });
  await channel.send("a");
  await channel.send("b");
  assertEquals(await channel.send("c"), {
    sequence: 3,
    status: "dropped-oldest",
    accepted: true,
    dropped: 1,
  });

  assertEquals(await channel.receive(), { done: false, value: "b", sequence: 2 });
  assertEquals(await channel.receive(), { done: false, value: "c", sequence: 3 });
  assertEquals(channel.inspect().droppedByPolicy.dropOldest, 1);
  assertEquals(channel.inspect().sent, 3);
});

Deno.test("conflate replaces only the newest buffered value and preserves the older prefix", async () => {
  const channel = new AsyncChannel<string>({ capacity: 2, overflowPolicy: "conflate" });
  await channel.send("a");
  await channel.send("b");
  assertEquals(await channel.send("c"), {
    sequence: 3,
    status: "conflated",
    accepted: true,
    dropped: 1,
  });

  assertEquals(await channel.receive(), { done: false, value: "a", sequence: 1 });
  assertEquals(await channel.receive(), { done: false, value: "c", sequence: 3 });
  assertEquals(channel.inspect().droppedByPolicy.conflate, 1);
});

Deno.test("error overflow rejects one send without poisoning the channel", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1, overflowPolicy: "error" });
  await channel.send("a");
  const overflow = await assertRejects(() => channel.send("b"), AsyncChannelOverflowError);
  assertEquals(overflow.sequence, 2);
  assertEquals(overflow.capacity, 1);
  assertEquals(overflow.depth, 1);
  assertEquals(channel.status, "open");
  assertEquals(await channel.receive(), { done: false, value: "a", sequence: 1 });
  assertEquals(await channel.send("c"), { sequence: 3, status: "buffered", accepted: true, dropped: 0 });
  assertEquals(channel.inspect().overflowErrors, 1);
});

Deno.test("graceful close rejects blocked sends, drains accepted values, and ends receivers", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  await channel.send("accepted");
  const blocked = channel.send("not accepted");
  const blockedRejection = assertRejects(() => blocked, AsyncChannelClosedError);

  assertEquals(channel.close(), true);
  assertEquals(channel.status, "closing");
  await blockedRejection;
  assertEquals(channel.inspect().pendingSends, 0);
  assertEquals(await channel.receive(), { done: false, value: "accepted", sequence: 1 });
  assertEquals(channel.status, "closed");
  assertEquals(await channel.receive(), { done: true, value: undefined });
  await assertRejects(() => channel.send("late"), AsyncChannelClosedError);
  assertEquals(channel.close(), false);

  const empty = new AsyncChannel<string>({ capacity: 1 });
  const waiting = empty.receive();
  assertEquals(empty.close(), true);
  assertEquals(await waiting, { done: true, value: undefined });
  assertEquals(empty.inspect().pendingReceives, 0);
});

Deno.test("abort discards accepted values and rejects current and future operations", async () => {
  const marker = new Error("operator stop");
  const channel = new AsyncChannel<string>({ capacity: 2 });
  await channel.send("a");
  await channel.send("b");
  const blocked = channel.send("c");
  const blockedRejection = assertRejects(() => blocked, AsyncChannelAbortedError);

  assertEquals(channel.abort(marker), true);
  const blockedError = await blockedRejection;
  assertStrictEquals(blockedError.cause, marker);
  const receiveError = await assertRejects(() => channel.receive(), AsyncChannelAbortedError);
  assertStrictEquals(receiveError.cause, marker);
  await assertRejects(() => channel.send("late"), AsyncChannelAbortedError);
  assertEquals(channel.abort(), false);
  assertEquals(channel.inspect().droppedByPolicy.abort, 2);
  assertEquals(channel.inspect().pendingSends, 0);

  const empty = new AsyncChannel<string>({ capacity: 1 });
  const waiting = empty.receive();
  const waitingRejection = assertRejects(() => waiting, AsyncChannelAbortedError);
  empty.abort(marker);
  assertStrictEquals((await waitingRejection).cause, marker);
  assertEquals(empty.inspect().pendingReceives, 0);
});

Deno.test("dispose discards buffers, rejects waiters with its own type, and is idempotent", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  await channel.send("a");
  const blocked = channel.send("b");
  const blockedRejection = assertRejects(() => blocked, AsyncChannelDisposedError);

  assertEquals(channel.dispose(), true);
  await blockedRejection;
  await assertRejects(() => channel.receive(), AsyncChannelDisposedError);
  await assertRejects(() => channel.send("late"), AsyncChannelDisposedError);
  assertEquals(channel.dispose(), false);
  assertEquals(channel.inspect().droppedByPolicy.dispose, 1);
  assertEquals(channel.inspect().depth, 0);

  const waitingChannel = new AsyncChannel<string>({ capacity: 1 });
  const waiting = waitingChannel.receive();
  const waitingRejection = assertRejects(() => waiting, AsyncChannelDisposedError);
  waitingChannel.dispose();
  await waitingRejection;
  assertEquals(waitingChannel.inspect().pendingReceives, 0);
});

Deno.test("AbortSignal cancellation removes blocked senders without disturbing fairness", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  await channel.send("head");
  const cancelledController = new AbortController();
  const cancelled = channel.send("cancelled", { signal: cancelledController.signal });
  const cancelledRejection = assertRejects(() => cancelled, AsyncChannelOperationAbortedError);
  const survivor = channel.send("survivor");
  assertEquals(channel.inspect().pendingSends, 2);

  cancelledController.abort("skip");
  const cancellation = await cancelledRejection;
  assertEquals(cancellation.operation, "send");
  assertEquals(cancellation.cause, "skip");
  assertEquals(channel.inspect().pendingSends, 1);
  assertEquals(await channel.receive(), { done: false, value: "head", sequence: 1 });
  assertEquals(await survivor, { sequence: 3, status: "buffered", accepted: true, dropped: 0 });
  assertEquals(await channel.receive(), { done: false, value: "survivor", sequence: 3 });

  const alreadyAborted = new AbortController();
  alreadyAborted.abort("before");
  const before = channel.inspect();
  await assertRejects(
    () => channel.send("never sequenced", { signal: alreadyAborted.signal }),
    AsyncChannelOperationAbortedError,
  );
  assertEquals(channel.inspect().sendAttempts, before.sendAttempts);
  assertEquals(channel.inspect().nextSequence, before.nextSequence);
});

Deno.test("AbortSignal cancellation removes receivers without stealing later delivery", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  const controller = new AbortController();
  const cancelled = channel.receive({ signal: controller.signal });
  const cancelledRejection = assertRejects(() => cancelled, AsyncChannelOperationAbortedError);
  const survivor = channel.receive();
  controller.abort("skip");

  const cancellation = await cancelledRejection;
  assertEquals(cancellation.operation, "receive");
  assertEquals(channel.inspect().pendingReceives, 1);
  await channel.send("value");
  assertEquals(await survivor, { done: false, value: "value", sequence: 1 });
  assertEquals(channel.inspect().pendingReceives, 0);
});

Deno.test("iterator return releases pending next calls without closing the shared channel", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  const first = channel.values();
  const pending = first.next();
  assertEquals(channel.inspect().pendingReceives, 1);

  assertEquals(await first.return(), { done: true, value: undefined });
  assertEquals(await pending, { done: true, value: undefined });
  assertEquals(await first.next(), { done: true, value: undefined });
  assertEquals(channel.inspect().pendingReceives, 0);
  assertEquals(channel.status, "open");

  await channel.send("still live");
  const second = channel[Symbol.asyncIterator]();
  assertEquals(await second.next(), { done: false, value: "still live", sequence: 1 });
  await second.return();
});

Deno.test("inspection is fixed-size clone-safe defensive and excludes queued values", async () => {
  const channel = new AsyncChannel<{ secret: string }>({
    capacity: 1,
    overflowPolicy: "drop-oldest",
    initialSequence: 7,
  });
  await channel.send({ secret: "FIRST_SECRET" });
  await channel.send({ secret: "SECOND_SECRET" });

  const snapshot = channel.inspect();
  assertEquals(snapshot.depth, 1);
  assertEquals(snapshot.sendAttempts, 2);
  assertEquals(snapshot.sent, 2);
  assertEquals(snapshot.received, 0);
  assertEquals(snapshot.dropped, 1);
  assertEquals(JSON.stringify(snapshot).includes("SECRET"), false);
  snapshot.depth = 999;
  snapshot.droppedByPolicy.dropOldest = 999;
  assertEquals(channel.inspect().depth, 1);
  assertEquals(channel.inspect().droppedByPolicy.dropOldest, 1);

  channel.abort(new Error("RAW_CAUSE_MUST_NOT_APPEAR"));
  const terminal = channel.inspect();
  assertEquals(terminal.terminalError, {
    name: "AsyncChannelAbortedError",
    message: "Async channel was aborted.",
  });
  assertEquals(JSON.stringify(terminal).includes("RAW_CAUSE"), false);
});

Deno.test("sequence exhaustion fails before mutation while the last safe value remains drainable", async () => {
  const channel = new AsyncChannel<string>({
    capacity: 1,
    initialSequence: Number.MAX_SAFE_INTEGER,
  });
  assertEquals(await channel.send("last"), {
    sequence: Number.MAX_SAFE_INTEGER,
    status: "buffered",
    accepted: true,
    dropped: 0,
  });
  assertEquals(channel.inspect().exhausted, true);
  await assertRejects(() => channel.send("overflow"), AsyncChannelSequenceOverflowError);
  assertEquals(channel.inspect().sendAttempts, 1);
  assertEquals(channel.inspect().depth, 1);
  assertEquals(await channel.receive(), {
    done: false,
    value: "last",
    sequence: Number.MAX_SAFE_INTEGER,
  });
  channel.close();
  assertEquals(await channel.receive(), { done: true, value: undefined });
});

Deno.test("hostile thenable values are transported without promise assimilation", async () => {
  let thenReads = 0;
  const value = Object.defineProperty({ marker: "value" }, "then", {
    get() {
      thenReads += 1;
      throw new Error("channel must not read value.then");
    },
  });
  const channel = new AsyncChannel<typeof value>({ capacity: 1 });

  await channel.send(value);
  const received = await channel.receive();
  assertEquals(received.done, false);
  if (!received.done) assertStrictEquals(received.value, value);
  assertEquals(thenReads, 0);
});

Deno.test("waiter cancellation and promise settlement remain safe under reentrant channel calls", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  await channel.send("head");
  const controller = new AbortController();
  const cancelled = channel.send("cancelled", { signal: controller.signal });
  const cancelledRejection = assertRejects(() => cancelled, AsyncChannelOperationAbortedError);
  let reentrant!: Promise<unknown>;
  let observedPending = -1;
  controller.signal.addEventListener("abort", () => {
    observedPending = channel.inspect().pendingSends;
    reentrant = channel.send("replacement");
  });

  controller.abort();
  await cancelledRejection;
  assertEquals(observedPending, 0);
  assertEquals(channel.inspect().pendingSends, 1);
  assertEquals(await channel.receive(), { done: false, value: "head", sequence: 1 });
  assertEquals(await reentrant, { sequence: 3, status: "buffered", accepted: true, dropped: 0 });
  assertEquals(await channel.receive(), { done: false, value: "replacement", sequence: 3 });

  const rendezvous = new AsyncChannel<string>({ capacity: 0 });
  const pending = rendezvous.send("x").then((result) => {
    assertEquals(rendezvous.inspect().pendingSends, 0);
    assertEquals(rendezvous.close(), true);
    return result;
  });
  const received = rendezvous.receive();
  assertEquals(await pending, { sequence: 1, status: "delivered", accepted: true, dropped: 0 });
  assertEquals(await received, { done: false, value: "x", sequence: 1 });
  assertEquals(rendezvous.status, "closed");
});

Deno.test("already-aborted waiters cannot win through earlier caller abort listeners", async () => {
  const producer = new AsyncChannel<string>({ capacity: 1 });
  await producer.send("head");
  const producerController = new AbortController();
  let producerReceive: Promise<unknown> | undefined;
  producerController.signal.addEventListener("abort", () => {
    producerReceive = producer.receive();
  });
  const blocked = producer.send("cancelled", { signal: producerController.signal });
  const blockedRejection = assertRejects(() => blocked, AsyncChannelOperationAbortedError);

  producerController.abort("producer stop");
  if (!producerReceive) throw new Error("The caller abort listener did not run.");
  assertEquals(await producerReceive, { done: false, value: "head", sequence: 1 });
  const producerError = await blockedRejection;
  assertEquals(producerError.cause, "producer stop");
  assertEquals(producer.inspect().depth, 0);
  assertEquals(producer.inspect().pendingSends, 0);

  const consumer = new AsyncChannel<string>({ capacity: 1 });
  const consumerController = new AbortController();
  let consumerSend: Promise<unknown> | undefined;
  consumerController.signal.addEventListener("abort", () => {
    consumerSend = consumer.send("survivor");
  });
  const waiting = consumer.receive({ signal: consumerController.signal });
  const waitingRejection = assertRejects(() => waiting, AsyncChannelOperationAbortedError);

  consumerController.abort("consumer stop");
  if (!consumerSend) throw new Error("The caller abort listener did not run.");
  assertEquals(await consumerSend, {
    sequence: 1,
    status: "buffered",
    accepted: true,
    dropped: 0,
  });
  const consumerError = await waitingRejection;
  assertEquals(consumerError.cause, "consumer stop");
  assertEquals(await consumer.receive(), { done: false, value: "survivor", sequence: 1 });
  assertEquals(consumer.inspect().pendingReceives, 0);
});

Deno.test("signal cleanup cannot reenter and corrupt promotion invariants", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  await channel.send("head");
  const controller = new AbortController();
  let reentered = false;
  Object.defineProperty(controller.signal, "removeEventListener", {
    configurable: true,
    value() {
      reentered = true;
      channel.abort("hostile cleanup");
    },
  });

  const blocked = channel.send("promoted", { signal: controller.signal });
  assertEquals(await channel.receive(), { done: false, value: "head", sequence: 1 });
  assertEquals(await blocked, {
    sequence: 2,
    status: "buffered",
    accepted: true,
    dropped: 0,
  });
  assertEquals(reentered, false);
  assertEquals(channel.status, "open");
  assertEquals(channel.inspect().depth, 1);
  assertEquals(await channel.receive(), { done: false, value: "promoted", sequence: 2 });
});

Deno.test("throwing AbortSignal reason overrides cannot strand pending operations", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  await channel.send("head");
  const controller = new AbortController();
  let reasonReads = 0;
  Object.defineProperty(controller.signal, "reason", {
    configurable: true,
    get() {
      reasonReads += 1;
      throw new Error("hostile reason getter");
    },
  });
  const blocked = channel.send("cancelled", { signal: controller.signal });
  const blockedRejection = assertRejects(() => blocked, AsyncChannelOperationAbortedError);

  controller.abort("safe reason");
  const error = await blockedRejection;
  assertEquals(error.cause, "safe reason");
  assertEquals(reasonReads, 0);
  assertEquals(channel.inspect().pendingSends, 0);
  assertEquals(await channel.receive(), { done: false, value: "head", sequence: 1 });
});

Deno.test("pending send and receive queues enforce explicit finite limits", async () => {
  const producers = new AsyncChannel<string>({
    capacity: 1,
    maxPendingSends: 1,
    maxPendingReceives: 3,
  });
  await producers.send("head");
  const survivor = producers.send("survivor");
  const sendLimit = await assertRejects(
    () => producers.send("overflow"),
    AsyncChannelWaiterLimitError,
  );
  assertEquals(sendLimit.operation, "send");
  assertEquals(sendLimit.limit, 1);
  assertEquals(sendLimit.pending, 1);
  assertEquals(producers.inspect().maxPendingSends, 1);
  assertEquals(producers.inspect().maxPendingReceives, 3);
  assertEquals(producers.inspect().pendingSends, 1);
  assertEquals(await producers.receive(), { done: false, value: "head", sequence: 1 });
  assertEquals(await survivor, {
    sequence: 2,
    status: "buffered",
    accepted: true,
    dropped: 0,
  });
  assertEquals(await producers.receive(), { done: false, value: "survivor", sequence: 2 });

  const consumers = new AsyncChannel<string>({ capacity: 1, maxPendingReceives: 1 });
  const waiting = consumers.receive();
  const receiveLimit = await assertRejects(
    () => consumers.receive(),
    AsyncChannelWaiterLimitError,
  );
  assertEquals(receiveLimit.operation, "receive");
  assertEquals(receiveLimit.limit, 1);
  assertEquals(receiveLimit.pending, 1);
  assertEquals(consumers.inspect().pendingReceives, 1);
  await consumers.send("value");
  assertEquals(await waiting, { done: false, value: "value", sequence: 1 });
});

Deno.test("terminal errors cannot be poisoned through exposed rejection references", async () => {
  const channel = new AsyncChannel<void>({ capacity: 1 });
  channel.abort("terminal cause");
  const terminal = await assertRejects(() => channel.receive(), AsyncChannelAbortedError);
  assertEquals(Object.isFrozen(terminal), true);
  assertEquals(
    Reflect.defineProperty(terminal, "name", {
      configurable: true,
      get() {
        throw new Error("poisoned terminal name");
      },
    }),
    false,
  );

  const inspection = structuredClone(channel.inspect());
  assertEquals(inspection.terminalError, {
    name: "AsyncChannelAbortedError",
    message: "Async channel was aborted.",
  });
  assertEquals(JSON.stringify(inspection).includes("terminal cause"), false);
  const future = await assertRejects(() => channel.send(undefined), AsyncChannelAbortedError);
  assertEquals(future.name, "AsyncChannelAbortedError");
  assertEquals(future.message, "Async channel was aborted.");
});

Deno.test("iterator AbortSignals reject pending next and leave no queue entry", async () => {
  const channel = new AsyncChannel<string>({ capacity: 1 });
  const controller = new AbortController();
  const iterator = channel.values({ signal: controller.signal });
  const pending = iterator.next();
  const rejected = assertRejects(() => pending, AsyncChannelOperationAbortedError);
  controller.abort("iterator stop");

  const error = await rejected;
  assertEquals(error.operation, "receive");
  assertEquals(error.cause, "iterator stop");
  assertEquals(channel.inspect().pendingReceives, 0);
  await iterator.return();
});

Deno.test("typed terminal errors remain distinct across close abort and disposal", async () => {
  const closed = new AsyncChannel<void>({ capacity: 1 });
  closed.close();
  assertInstanceOf(await assertRejects(() => closed.send(undefined)), AsyncChannelClosedError);

  const aborted = new AsyncChannel<void>({ capacity: 1 });
  aborted.abort();
  assertInstanceOf(await assertRejects(() => aborted.receive()), AsyncChannelAbortedError);

  const disposed = new AsyncChannel<void>({ capacity: 1 });
  disposed.dispose();
  assertInstanceOf(await assertRejects(() => disposed.receive()), AsyncChannelDisposedError);
});
