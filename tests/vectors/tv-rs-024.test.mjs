import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-024 ${vectorNames["024"]}`, async () => runVector("024"));
