import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-003 ${vectorNames["003"]}`, async () => runVector("003"));
