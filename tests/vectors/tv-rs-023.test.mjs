import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-023 ${vectorNames["023"]}`, async () => runVector("023"));
