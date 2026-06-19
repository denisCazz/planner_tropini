-- CreateTable
CREATE TABLE "RouteHistory" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientIds" INTEGER[],
    "label" TEXT NOT NULL,
    "totalDistance" DOUBLE PRECISION NOT NULL,
    "totalDuration" INTEGER NOT NULL,
    "stopCount" INTEGER NOT NULL,

    CONSTRAINT "RouteHistory_pkey" PRIMARY KEY ("id")
);
