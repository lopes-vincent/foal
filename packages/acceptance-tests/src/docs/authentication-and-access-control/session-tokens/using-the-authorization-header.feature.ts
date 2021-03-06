// std
import { notStrictEqual, strictEqual } from 'assert';

// 3p
import * as request from 'supertest';

// FoalTS
import {
  Config,
  Context,
  controller,
  createApp,
  createSession,
  dependency,
  Get,
  HttpResponseOK,
  IAppController,
  Post,
  Session,
  Store,
  UseSessions
} from '@foal/core';
import { DatabaseSession } from '@foal/typeorm';
import { closeTestConnection, createTestConnection, getTypeORMStorePath } from '../../../common';

describe('Feature: Using the Authorization header', () => {

  beforeEach(() => {
    Config.set('settings.session.store', getTypeORMStorePath());
  });

  afterEach(() => {
    Config.remove('settings.session.store');
    return closeTestConnection();
  });

  it('Example: Simple usage with optional bearer tokens', async () => {

    let session: Session|undefined;

    /* ======================= DOCUMENTATION BEGIN ======================= */

    @UseSessions()
    class ApiController {

      @dependency
      store: Store;

      @Post('/login')
      async login(ctx: Context) {
        // Check the user credentials...

        ctx.session = await createSession(this.store);

        // See the "authentication" section below
        // to see how to associate a user to the session.

        return new HttpResponseOK({
          token: ctx.session.getToken()
        });
      }

      @Get('/products')
      readProducts(ctx: Context) {
        // If the request has an Authorization header with a valid token
        // then ctx.session is defined.
        // Not in the documentation:
        session = ctx.session;
        return new HttpResponseOK([]);
      }

    }

    /* ======================= DOCUMENTATION END ========================= */

    class AppController implements IAppController {
      subControllers = [
        controller('/api', ApiController),
      ];

      async init() {
        await createTestConnection([ DatabaseSession ]);
      }
    }

    const app = await createApp(AppController);

    strictEqual(session, undefined);

    await request(app)
      .get('/api/products')
      .expect(200)
      .expect([]);

    strictEqual(session, undefined);

    const response = await request(app)
      .post('/api/login')
      .send({})
      .expect(200);

    strictEqual(session, undefined);

    const token: undefined|string = response.body.token;
    if (token === undefined) {
      throw new Error('The server should have returned a session token.');
    }

    await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);

    notStrictEqual(session, undefined);
    strictEqual((session as unknown as Session).getToken(), token);

  });

  it('Example: Usage with required bearer tokens', async () => {

    let session: Session|undefined;

    /* ======================= DOCUMENTATION BEGIN ======================= */

    class ApiController {

      @dependency
      store: Store;

      @Post('/login')
      @UseSessions()
      async login(ctx: Context) {
        // Check the user credentials...

        ctx.session = await createSession(this.store);

        // See the "authentication" section below
        // to see how to associate a user to the session.

        return new HttpResponseOK({
          token: ctx.session.getToken()
        });
      }

      @Get('/products')
      @UseSessions({ required: true })
      readProducts(ctx: Context) {
        // ctx.session is defined.
        // Not in the documentation:
        session = ctx.session;
        return new HttpResponseOK([]);
      }

    }

    /* ======================= DOCUMENTATION END ========================= */

    class AppController implements IAppController {
      subControllers = [
        controller('/api', ApiController),
      ];

      async init() {
        await createTestConnection([ DatabaseSession ]);
      }
    }

    const app = await createApp(AppController);

    strictEqual(session, undefined);

    await request(app)
      .get('/api/products')
      .expect(400)
      .expect({
        code: 'invalid_request',
        description: 'Authorization header not found.'
      });

    strictEqual(session, undefined);

    const response = await request(app)
      .post('/api/login')
      .send({})
      .expect(200);

    strictEqual(session, undefined);

    const token: undefined|string = response.body.token;
    if (token === undefined) {
      throw new Error('The server should have returned a session token.');
    }

    await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);

    notStrictEqual(session, undefined);
    strictEqual((session as unknown as Session).getToken(), token);
  });

});
