import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-007 ${vectorNames["007"]}`, async () => runVector("007"));
