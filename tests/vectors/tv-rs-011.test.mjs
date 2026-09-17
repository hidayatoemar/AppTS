import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-011 ${vectorNames["011"]}`, async () => runVector("011"));
