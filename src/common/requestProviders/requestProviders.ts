import superagent from 'superagent';
import { Injectable, Scope } from '@nestjs/common';

export class RequestProvider {
  async get(configs) {
    console.log({configs})
    console.log("yess superagent")
    try {
      const response: superagent.Response = await superagent
        .get(configs.url)
        .query(configs.query)
        .set(configs.headers)
        .timeout(configs.timeout);
        console.log({response})
      return response && response['body'];
    } catch (err) {
      throw err;
    }
  }

  async post(configs) {
    try {
      const response: superagent.Response = await superagent
        .post(configs.url)
        .query(configs.query)
        .set(configs.headers)
        .send(configs.data)
        .timeout(configs.timeout);
      return response && response['body'];
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  async postWithFormData(configs) {
    try {
      const response: superagent.Response = await superagent
        .post(configs.url)
        .query(configs.query)
        .set(configs.headers)
        .field(configs.fields)
        .timeout(configs.timeout)
        .accept(configs.accept);
      return response && response['body'];
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}
