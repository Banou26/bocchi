import type { OperationVariables, QueryHookOptions, TypedDocumentNode, DocumentNode } from '@apollo/client'
import type { ApolloServerOptions, BaseContext } from '@apollo/server'

import { ApolloServer } from '@apollo/server'
import { ApolloClient, InMemoryCache, HttpLink, useQuery } from '@apollo/client'
import { useEffect, useState } from 'react'

type MakeBocchiOptions<TContext extends BaseContext> =
  Required<
    Pick<
      ApolloServerOptions<TContext>,
      'typeDefs' | 'resolvers'
    >
  >


export const makeBocchi = <TContext extends BaseContext>({ typeDefs, resolvers }: MakeBocchiOptions<TContext>) => {
  const server = new ApolloServer({
    typeDefs,
    resolvers
  })
  server.start()
  const fetch: (input: RequestInfo | URL, init: RequestInit) => Promise<Response> = async (input, init) => {
    const body = JSON.parse(init.body!.toString())
    const headers = new Map<string, string>()
    for (const [key, value] of Object.entries(init.headers!)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      }
    }
    const httpGraphQLRequest = {
      body,
      headers,
      method: init.method!,
      search: ''
    }
    // console.log('httpGraphQLRequest', httpGraphQLRequest)
    const req: Parameters<typeof server['executeOperation']>[0] = {
      query: body.query,
      variables: body.variables,
      operationName: body.operationName,
      http: httpGraphQLRequest
    }
    // console.log('req', req)
    const res = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: async () => ({ input, init })
    })
    return new Response(res.body.string, { headers: res.headers })
  }
  const apolloCache = new InMemoryCache()
  const client = new ApolloClient({
    cache: apolloCache,
    link: new HttpLink({ fetch })
  })
  return {
    server,
    client,
    cache: apolloCache
  }
}

export default makeBocchi

export const useBocchiQuery = <T, T2 = OperationVariables>(query: DocumentNode | TypedDocumentNode<T, T2>, options?: QueryHookOptions<T, T2>) => {
  const [defaultAbort] = useState(new AbortController())
  const result = useQuery(
    query,
    {
      ...options,
      fetchPolicy: options?.fetchPolicy ?? 'cache-and-network',
      context:
        options?.context ?? {
          ...options?.context,
          fetchOptions:
            options?.context?.fetchOptions ?? {
              ...options?.context?.fetchOptions,
              signal: defaultAbort.signal
            }
        }
    }
  )
  useEffect(() => {
    return () => {
      defaultAbort.abort()
    }
  }, [])
  return result
}

export {
  useBocchiQuery as useQuery
}
