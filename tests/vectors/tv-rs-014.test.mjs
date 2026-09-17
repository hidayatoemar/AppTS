import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-014 ${vectorNames["014"]}`, async () => runVector("014"));
