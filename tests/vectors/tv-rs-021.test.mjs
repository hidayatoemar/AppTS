import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-021 ${vectorNames["021"]}`, async () => runVector("021"));
