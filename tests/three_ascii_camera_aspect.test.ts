import { assertEquals } from "./deps.ts";
import {
  computeThreeAsciiCameraAspect,
  shouldUpdateThreeAsciiCameraAspect,
  THREE_ASCII_CAMERA_ASPECT_EPSILON,
} from "../src/three_ascii/camera_aspect.ts";

Deno.test("computeThreeAsciiCameraAspect accounts for terminal pixel aspect ratio", () => {
  assertEquals(computeThreeAsciiCameraAspect({ columns: 80, rows: 40, pixelAspectRatio: 0.5 }), 1);
  assertEquals(computeThreeAsciiCameraAspect({ columns: 120, rows: 40, pixelAspectRatio: 0.5 }), 1.5);
});

Deno.test("computeThreeAsciiCameraAspect clamps zero or negative rows to one", () => {
  assertEquals(computeThreeAsciiCameraAspect({ columns: 10, rows: 0, pixelAspectRatio: 0.5 }), 5);
  assertEquals(computeThreeAsciiCameraAspect({ columns: 10, rows: -2, pixelAspectRatio: 0.5 }), 5);
});

Deno.test("shouldUpdateThreeAsciiCameraAspect ignores epsilon-sized differences", () => {
  assertEquals(
    shouldUpdateThreeAsciiCameraAspect(1, 1 + THREE_ASCII_CAMERA_ASPECT_EPSILON),
    false,
  );
  assertEquals(
    shouldUpdateThreeAsciiCameraAspect(1, 1 + THREE_ASCII_CAMERA_ASPECT_EPSILON * 2),
    true,
  );
});
