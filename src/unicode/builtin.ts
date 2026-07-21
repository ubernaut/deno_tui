// Copyright 2023 Im-Beast. MIT license.

import {
  inspectUnicodeDataPack,
  type UnicodeDataPack,
  type UnicodeDataPackInspection,
  UnicodeDataPackRegistry,
  validateUnicodeDataPack,
} from "./data_pack.ts";
import { GENERATED_UNICODE_17_0_0_DATA_PACK } from "./generated/unicode_17_0_0.ts";

/** Unicode Character Database version pinned by the built-in runtime pack. */
export const UNICODE_DATA_VERSION = "17.0.0" as const;

/** Validated and deeply immutable checked-in Unicode data. */
export const BUILTIN_UNICODE_DATA_PACK: UnicodeDataPack = validateUnicodeDataPack(GENERATED_UNICODE_17_0_0_DATA_PACK);

/** Bounded runtime metadata, including official source URLs and SHA-256 pins. */
export const BUILTIN_UNICODE_DATA_PACK_INSPECTION: UnicodeDataPackInspection = inspectUnicodeDataPack(
  BUILTIN_UNICODE_DATA_PACK,
);

/** Immutable default registry; fixture registries can be constructed independently. */
export const DEFAULT_UNICODE_DATA_PACK_REGISTRY: UnicodeDataPackRegistry = new UnicodeDataPackRegistry(
  [BUILTIN_UNICODE_DATA_PACK],
  {
    defaultUnicodeVersion: UNICODE_DATA_VERSION,
  },
);
