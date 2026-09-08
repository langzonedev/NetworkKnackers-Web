export const RESULT_STATUS = Object.freeze({
  SUCCESS: "success",
  UNSUPPORTED: "unsupported",
  ERROR: "error"
});

const unavailable = (label, detail) => ({ label, value: "Unavailable", detail, kind: "unavailable" });

export function formatConnectionSnapshot(navigatorLike = {}) {
  const connection = navigatorLike.connection || navigatorLike.mozConnection || navigatorLike.webkitConnection;
  const online = typeof navigatorLike.onLine === "boolean" ? navigatorLike.onLine : null;
  const fields = [
    online === null
      ? unavailable("Browser status", "This browser did not expose an online state.")
      : { label: "Browser status", value: online ? "Online" : "Offline", detail: "A browser connectivity hint, not proof of internet reachability.", kind: online ? "observed" : "warning" }
  ];

  if (!connection) {
    fields.push(unavailable("Connection estimate", "The Network Information API is not supported here."));
  } else {
    fields.push(
      connection.effectiveType
        ? { label: "Effective connection", value: String(connection.effectiveType).toUpperCase(), detail: "Estimated from recent browser traffic; this is not the physical Wi-Fi/cellular type.", kind: "estimated" }
        : unavailable("Effective connection", "Not exposed by this browser."),
      Number.isFinite(connection.rtt)
        ? { label: "Estimated round trip", value: `${connection.rtt} ms`, detail: "Browser estimate, not a ping to your gateway.", kind: "estimated" }
        : unavailable("Estimated round trip", "Not exposed by this browser."),
      Number.isFinite(connection.downlink)
        ? { label: "Estimated downlink", value: `${connection.downlink} Mbps`, detail: "Rounded browser estimate based on recent application traffic.", kind: "estimated" }
        : unavailable("Estimated downlink", "Not exposed by this browser."),
      typeof connection.saveData === "boolean"
        ? { label: "Data saver", value: connection.saveData ? "On" : "Off", detail: "Browser/device preference.", kind: "observed" }
        : unavailable("Data saver", "Not exposed by this browser.")
    );
  }

  fields.push(
    unavailable("Local address", "Web pages do not receive a reliable local interface address."),
    unavailable("Default gateway", "Web pages cannot read the operating system routing table."),
    unavailable("Network / subnet", "Web pages cannot read the interface netmask or route.")
  );

  return {
    status: RESULT_STATUS.SUCCESS,
    title: "My Connection",
    summary: online === false ? "This browser currently reports that it is offline." : "Here is what this browser can safely reveal right now.",
    fields,
    note: "Observed and estimated values are labelled. Network Knackers does not guess missing details."
  };
}

export const capabilityModules = Object.freeze([
  {
    id: "connection.snapshot",
    title: "My Connection",
    description: "See the connection signals this browser genuinely exposes.",
    availability: "available",
    requirements: ["browser"],
    activity: "passive",
    run: ({ navigator: navigatorLike }) => Promise.resolve(formatConnectionSnapshot(navigatorLike))
  },
  {
    id: "gateway.identify",
    title: "Identify Gateway",
    description: "Find the router handling traffic for this device.",
    availability: "native-required",
    requirements: ["native-network-engine"],
    activity: "passive",
    run: () => Promise.resolve({
      status: RESULT_STATUS.UNSUPPORTED,
      title: "Identify Gateway",
      summary: "A normal browser cannot read your device’s default gateway.",
      fields: [],
      note: "This action needs the future Network Knackers native engine. No address was guessed or probed."
    })
  },
  {
    id: "devices.discover",
    title: "Discover Devices",
    description: "Find devices and advertised services on the local network.",
    availability: "planned",
    requirements: ["native-network-engine"],
    activity: "active"
  },
  {
    id: "diagnostics.run",
    title: "Diagnostics",
    description: "Run targeted reachability, DNS and route checks.",
    availability: "planned",
    requirements: ["target", "capability-engine"],
    activity: "active"
  }
]);

export function validateModule(module) {
  const required = ["id", "title", "description", "availability", "requirements", "activity"];
  return required.every((key) => Object.hasOwn(module, key)) &&
    Array.isArray(module.requirements) &&
    (module.availability !== "available" || typeof module.run === "function");
}
