import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-004 ${vectorNames["004"]}`, async () => runVector("004"));
