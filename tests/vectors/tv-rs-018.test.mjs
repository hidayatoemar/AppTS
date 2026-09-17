import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-018 ${vectorNames["018"]}`, async () => runVector("018"));
