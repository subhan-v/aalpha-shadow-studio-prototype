// Public demo build (demo.headroom.aalpha.ai): client app only, sample agencies only.
// Set NEXT_PUBLIC_DEMO=1 on the demo Vercel project. The internal staging build leaves it unset.
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1"
export const DEMO_HOME = "/client/larkspur"
// The product name people see. Clients and their teams only ever see Headroom (2026-11-10);
// Shadow is the internal name for the data layer and Studio.
export const APP = "Headroom"
