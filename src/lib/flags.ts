// Public demo build (demo.headroom.aalpha.ai): client app only, sample agencies only.
// Set NEXT_PUBLIC_DEMO=1 on the demo Vercel project. The internal staging build leaves it unset.
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1"
export const DEMO_HOME = "/client/larkspur"
