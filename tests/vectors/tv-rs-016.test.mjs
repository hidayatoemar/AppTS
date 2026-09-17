import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-016 ${vectorNames["016"]}`, async () => runVector("016"));
