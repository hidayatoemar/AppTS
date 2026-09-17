import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-009 ${vectorNames["009"]}`, async () => runVector("009"));
