import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-026 ${vectorNames["026"]}`, async () => runVector("026"));
