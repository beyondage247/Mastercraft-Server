import { Param, ParseUUIDPipe } from '@nestjs/common';

export const IdParam = (param = 'id') => Param(param, ParseUUIDPipe);
