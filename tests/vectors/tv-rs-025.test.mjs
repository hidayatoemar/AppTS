import test from "node:test";
import { runVector, vectorNames } from "./vector-cases.mjs";
test(`TV-RS-025 ${vectorNames["025"]}`, async () => runVector("025"));
