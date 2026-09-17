import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-019 ${vectorNames["019"]}`, async () => runVector("019"));
