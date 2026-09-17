import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-020 ${vectorNames["020"]}`, async () => runVector("020"));
