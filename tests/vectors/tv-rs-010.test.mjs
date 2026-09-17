import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-010 ${vectorNames["010"]}`, async () => runVector("010"));
