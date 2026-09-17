import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-022 ${vectorNames["022"]}`, async () => runVector("022"));
