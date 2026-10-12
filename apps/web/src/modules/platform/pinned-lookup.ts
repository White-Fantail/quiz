import type { LookupFunction } from "node:net";

/**
 * A DNS lookup adapter that never performs a second DNS resolution.
 *
 * Node's HTTPS agent may call lookup with { all: true } (including with
 * autoSelectFamily enabled), in which case it MUST receive LookupAddress[].
 * Returning a single IP string there causes ERR_INVALID_IP_ADDRESS.
 */
export function pinnedLookup(chosen: { address: string; family: 4 | 6 }): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: chosen.address, family: chosen.family }]);
    } else {
      callback(null, chosen.address, chosen.family);
    }
  };
}
