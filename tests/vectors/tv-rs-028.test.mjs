import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-028 ${vectorNames["028"]}`, async () => runVector("028"));
