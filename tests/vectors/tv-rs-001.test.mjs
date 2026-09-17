import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-001 ${vectorNames["001"]}`, async () => runVector("001"));
