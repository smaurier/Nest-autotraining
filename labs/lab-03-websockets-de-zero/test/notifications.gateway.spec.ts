// notifications.gateway.spec.ts — Oracle UNITAIRE. Instancie le Gateway DIRECTEMENT (pas de
// vrai socket.io ici), client et server MOCKÉS. Ne pas modifier.
import { WsException } from "@nestjs/websockets";
import { NotificationsGateway } from "../src/notifications/notifications.gateway";

describe("NotificationsGateway", () => {
  let gateway: NotificationsGateway;
  let client: { join: jest.Mock };
  let toEmit: jest.Mock;

  beforeEach(() => {
    gateway = new NotificationsGateway();
    client = { join: jest.fn() };
    toEmit = jest.fn();
    // @ts-expect-error — on pose un faux server minimal, suffisant pour ce test.
    gateway.server = { to: jest.fn(() => ({ emit: toEmit })) };
  });

  it("join fait rejoindre le client à la room de la famille", () => {
    gateway.handleJoin(client as never, "famille-42");
    expect(client.join).toHaveBeenCalledWith("famille-42");
  });

  it("post:create diffuse à la room de la famille avec les bons champs", () => {
    gateway.handlePostCreate(client as never, { familyId: "famille-42", content: "Salut !" });
    expect((gateway.server.to as jest.Mock)).toHaveBeenCalledWith("famille-42");
    expect(toEmit).toHaveBeenCalledWith(
      "post:created",
      expect.objectContaining({ familyId: "famille-42", content: "Salut !" }),
    );
    const post = toEmit.mock.calls[0][1];
    expect(typeof post.id).toBe("string");
    expect(typeof post.createdAt).toBe("string");
  });

  it("post:create avec un content vide lève WsException, sans jamais diffuser", () => {
    expect(() => gateway.handlePostCreate(client as never, { familyId: "f1", content: "   " })).toThrow(WsException);
    expect(toEmit).not.toHaveBeenCalled();
  });
});
