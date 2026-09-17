import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-015 ${vectorNames["015"]}`, async () => runVector("015"));
