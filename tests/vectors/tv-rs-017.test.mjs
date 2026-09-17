import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-017 ${vectorNames["017"]}`, async () => runVector("017"));
