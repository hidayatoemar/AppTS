import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-006 ${vectorNames["006"]}`, async () => runVector("006"));
