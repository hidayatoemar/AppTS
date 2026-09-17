import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-005 ${vectorNames["005"]}`, async () => runVector("005"));
