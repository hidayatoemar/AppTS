import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-012 ${vectorNames["012"]}`, async () => runVector("012"));
