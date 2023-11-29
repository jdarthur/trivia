import {createApi, fetchBaseQuery, retry} from '@reduxjs/toolkit/query/react';


export const baseQuery = retry(fetchBaseQuery({
    baseUrl: '/',
    prepareHeaders: (headers, {getState}) => {
        const userToken = getState().auth.token;

        if (userToken) {
            headers.set('borttrivia-token', userToken);
        }

        return headers;
    },
    fetchFn: (input) => {
        //regular fetch on input but don't actually send it if we don't have a token
        if (input.headers.get('borttrivia-token')) {
            return fetch(input)
        }
    }

}), {
    maxRetries: 5,
})

export const mainApi = createApi({
    reducerPath: 'mainApi',
    baseQuery: baseQuery,
    endpoints: (builder) => ({
        getCollections: builder.query({
            query: () => ({url: `editor/collections`}),
            providesTags: ['collections']
        }),
        getCollection: builder.query({
            query: (id) => ({url: `editor/collections/${id}`}),
        }),
        createCollection: builder.mutation({
            query: (body) => ({
                url: `editor/collections`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ['collections']
        }),
        deleteCollection: builder.mutation({
            query: (id) => ({
                url: `editor/collections/${id}`,
                method: "DELETE"
            }),
            invalidatesTags: ['collections']
        }),
        importCollection: builder.mutation({
            query: (id) => ({
                url: `editor/collections/${id}/import`,
                method: "POST"
            }),
        }),
        getQuestions: builder.query({
            query: (queryParams) => ({
                url: `editor/questions${queryParams ? queryParams : ""}`,
            }),
            providesTags: ["questions"]
        }),
        createQuestion: builder.mutation({
            query: (body) => ({
                url: `editor/question`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["questions"]
        }),
        updateQuestion: builder.mutation({
            query: (args) => ({
                url: `editor/question/${args.id}`,
                method: "PUT",
                body: args.body
            }),
            invalidatesTags: ["questions"]
        }),
        deleteQuestion: builder.mutation({
            query: (id) => ({
                url: `editor/question/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["questions"]
        }),
        getScoringNotes: builder.query({
            query: () => ({
                url: `editor/scoring_notes`,
            }),
            providesTags: ["scoring_notes"]
        }),
        getOneScoringNote: builder.query({
            query: (id) => ({
                url: `editor/scoring_notes/${id}`,
            }),
        }),
        createScoringNote: builder.mutation({
            query: (body) => ({
                url: `editor/scoring_notes`,
                method: "POST",
                body: body
            }),
            invalidatesTags: ["scoring_notes"]
        }),
        deleteScoringNote: builder.mutation({
            query: (id) => ({
                url: `editor/scoring_notes/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["scoring_notes", "questions"]
        }),
    })
})

export const {
    useGetCollectionsQuery,
    useGetCollectionQuery,
    useCreateCollectionMutation,
    useDeleteCollectionMutation,
    useImportCollectionMutation,
    useGetQuestionsQuery,
    useCreateQuestionMutation,
    useUpdateQuestionMutation,
    useDeleteQuestionMutation,
    useGetScoringNotesQuery,
    useGetOneScoringNoteQuery,
    useCreateScoringNoteMutation,
    useDeleteScoringNoteMutation,
} = mainApi