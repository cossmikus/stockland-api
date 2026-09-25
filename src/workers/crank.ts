/** One-shot crank for external cron: `npm run crank`. Same code path as the in-process scheduler. */
import { runEpochTurn } from "../services/crank.js";
runEpochTurn().then((r) => { console.log(JSON.stringify(r)); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
