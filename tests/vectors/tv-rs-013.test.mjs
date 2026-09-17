import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-013 ${vectorNames["013"]}`, async () => runVector("013"));
