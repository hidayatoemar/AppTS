import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-027 ${vectorNames["027"]}`, async () => runVector("027"));
