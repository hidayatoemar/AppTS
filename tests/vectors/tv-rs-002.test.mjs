import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-002 ${vectorNames["002"]}`, async () => runVector("002"));
