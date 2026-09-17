import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-008 ${vectorNames["008"]}`, async () => runVector("008"));
